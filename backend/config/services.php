<?php

return [
    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY', env('RESEND_API_KEY')),
    ],

    'brevo' => [
        'key' => env('BREVO_API_KEY'),
    ],

    'piisend' => [
        'key' => env('PIISEND_API_KEY'),
    ],

    'mailersend' => [
        'key' => env('MAILERSEND_API_KEY'),
    ],

    // AI summaries on the dashboard (Claude). Without a key, alerts still work.
    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'summary_model' => env('AI_SUMMARY_MODEL', 'claude-opus-5-5'),
    ],

    // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
    'cron' => [
        'secret' => env('CRON_SECRET'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],
];
