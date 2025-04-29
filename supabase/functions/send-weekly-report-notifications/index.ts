import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

interface UserProfile {
  id: string;
  phone: string;
  timezone: string;
}

interface DailyLogData {
  weekly_report_reminder_sent_at: string | null;
}

interface ResultDetail {
  userId: string;
  phone: string;
  status: 'success' | 'failed' | 'skipped' | 'success_log_failed';
  sid?: string;
  error?: string | Record<string, any>;
  reason?: string;
}

const TARGET_WEEKLY_REPORT_DAY = 0; // Sunday (0 = Sunday, 1 = Monday, etc.)
const TARGET_WEEKLY_REPORT_HOUR = 9; // 9 AM (local time)

console.log(`Starting send-weekly-report-notifications function (Target Local Day: Sunday, Hour: ${TARGET_WEEKLY_REPORT_HOUR})...`);

function calculateLocalDayAndHour(utcDate: Date, timezone: string): { day: number; hour: number } | null {
  try {
    // Use 'short' weekday format for better reliability
    const formatter = new Intl.DateTimeFormat('en-US', { // Using 'en-US' locale for consistent short names
      timeZone: timezone,
      weekday: 'short', // CHANGED from 'narrow'
      hour: 'numeric',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(utcDate);
    const dayPart = parts.find(part => part.type === 'weekday');
    const hourPart = parts.find(part => part.type === 'hour');

    if (!dayPart || !hourPart) {
         console.error(`[User: ${timezone}] Could not extract day/hour parts from date.`);
         return null;
    }

    // Map based on 'short' weekday names (more robust)
    const dayMap: { [key: string]: number } = {
         'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const day = dayMap[dayPart.value]; // Use the short name like 'Sun', 'Mon' etc.
    const hour = parseInt(hourPart.value, 10);

    // Validate the parsed day and hour
    if (day === undefined || isNaN(hour) || hour < 0 || hour > 23) {
      console.error(`[User: <span class="math-inline">\{timezone\}\] Invalid day part '</span>{dayPart.value}' (mapped to ${day}) or hour ${hour} calculated`);
      return null;
    }
    // console.log(`[User: ${timezone}] Calculated local day: ${day}, hour: ${hour}`); // Optional: Add for debugging if needed
    return { day, hour };
  } catch (e) {
    // Catch errors during timezone formatting (e.g., invalid timezone string)
    console.error(`[User: ${timezone}] Failed to calculate local day and hour:`, e);
    return null;
  }
}

function calculateLocalDateString(utcDate: Date, timezone: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(utcDate);
  } catch (e) {
    console.error(`[User: ${timezone}] Failed to calculate local date string:`, e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );
    console.log('Supabase admin client initialized.');

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.error('Twilio credentials missing in environment variables.');
      throw new Error('Twilio credentials missing.');
    }
    console.log('Twilio credentials retrieved.');

    const nowUtc = new Date();
    const nowIsoString = nowUtc.toISOString();
    console.log(`Current UTC time: ${nowIsoString}`);

    console.log('Querying profiles for users with SMS enabled, phone, and timezone...');
    const { data: potentialUsers, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone, timezone')
      .eq('enable_sms_notifications', true)
      .not('phone', 'is', null)
      .not('timezone', 'is', null);

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      throw profilesError;
    }

    if (!potentialUsers || potentialUsers.length === 0) {
      console.log('No potential users found.');
      return new Response(JSON.stringify({ message: 'No potential users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    console.log(`Found ${potentialUsers.length} potential users.`);

    const timeEligibleUsers = potentialUsers.filter((user: UserProfile) => {
      const localInfo = calculateLocalDayAndHour(nowUtc, user.timezone);
      if (!localInfo) return false;
      return localInfo.day === TARGET_WEEKLY_REPORT_DAY && localInfo.hour === TARGET_WEEKLY_REPORT_HOUR;
    });

    console.log(`Found ${timeEligibleUsers.length} users eligible based on local time (Day: Sunday, Hour: ${TARGET_WEEKLY_REPORT_HOUR}:00).`);

    if (timeEligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No users in the target local time zone hour right now.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioHeaders = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const results: ResultDetail[] = [];

    for (const user of timeEligibleUsers) {
      const userId = user.id;

      const localDateString = calculateLocalDateString(nowUtc, user.timezone);
      if (!localDateString) {
        console.log(`[User: ${userId}] Skipping due to invalid local date calculation.`);
        results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Date calculation error' });
        continue;
      }

      console.log(`[User: ${userId}] Checking daily log for date ${localDateString}...`);
      try {
        const { data: logData, error: logError } = await supabaseAdmin
          .from('daily_logs')
          .select('weekly_report_reminder_sent_at')
          .eq('user_id', userId)
          .eq('log_date', localDateString)
          .maybeSingle();

        if (logError) {
          console.error(`[User: ${userId}] Error fetching daily log for ${localDateString}:`, logError.message);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Error fetching daily log: ${logError.message}` });
          continue;
        }

        if (logData && logData.weekly_report_reminder_sent_at) {
          console.log(`[User: ${userId}] Weekly report reminder already sent on ${localDateString}. Skipping.`);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Already sent' });
          continue;
        }
        console.log(`[User: ${userId}] Reminder not sent yet for ${localDateString}. Proceeding.`);
      } catch (e) {
        console.error(`[User: ${userId}] Unexpected error during daily log check:`, e);
        results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Log check exception: ${e.message}` });
        continue;
      }

      const messageBody = `📊 Your Jo App weekly report is ready! Check your progress at: https://your-app-url/weekly-report`;
      const requestBody = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });

      console.log(`[User: ${userId}] Attempting to send weekly report SMS to ${user.phone}...`);
      let smsSentSuccessfully = false;
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: twilioHeaders, body: requestBody.toString() });
        const responseData = await response.json();

        if (!response.ok) {
          console.error(`[User: ${userId}] Twilio API error: Status ${response.status}`, responseData);
          results.push({ userId: userId, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`[User: ${userId}] Weekly report SMS sent successfully. SID: ${responseData.sid}`);
          results.push({ userId: userId, phone: user.phone, status: 'success', sid: responseData.sid });
          smsSentSuccessfully = true;
        }
      } catch (fetchError: unknown) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        console.error(`[User: ${userId}] Network/Fetch error sending SMS:`, fetchError);
        results.push({ userId: userId, phone: user.phone, status: 'failed', error: errorMessage });
      }

      if (smsSentSuccessfully) {
        console.log(`[User: ${userId}] Updating daily_log for ${localDateString} to mark reminder sent...`);
        try {
          const { error: upsertError } = await supabaseAdmin
            .from('daily_logs')
            .upsert(
              {
                user_id: userId,
                log_date: localDateString,
                weekly_report_reminder_sent_at: nowIsoString
              },
              {
                onConflict: 'user_id, log_date',
              }
            );

          if (upsertError) {
            console.error(`[User: ${userId}] Error upserting daily_log for ${localDateString}:`, upsertError.message);
            const resultIndex = results.findIndex(r => r.userId === userId && r.status === 'success');
            if (resultIndex !== -1) {
              results[resultIndex].status = 'success_log_failed';
              results[resultIndex].error = `Upsert failed: ${upsertError.message}`;
            }
          } else {
            console.log(`[User: ${userId}] Successfully updated daily_log for ${localDateString}.`);
          }
        } catch (e) {
          console.error(`[User: ${userId}] Unexpected error during daily_log upsert:`, e);
          const resultIndex = results.findIndex(r => r.userId === userId && r.status === 'success');
          if (resultIndex !== -1) {
            results[resultIndex].status = 'success_log_failed';
            results[resultIndex].error = `Upsert exception: ${e.message}`;
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log('Finished processing weekly report notifications.');
    return new Response(JSON.stringify({ message: 'Weekly report notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error: unknown) {
    console.error('Unhandled error in weekly report function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});