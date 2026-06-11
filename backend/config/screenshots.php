<?php

return [
    'disk' => env('SCREENSHOT_DISK', env('FILESYSTEM_DISK', 'public')),
    'retention_days' => (int) env('SCREENSHOT_RETENTION_DAYS', 60),
    'max_upload_kb' => (int) env('SCREENSHOT_MAX_UPLOAD_KB', 5120),
    'rate_limit_per_minute' => (int) env('SCREENSHOT_RATE_LIMIT', 10),
    'agent_heartbeat_threshold_minutes' => (int) env('SCREENSHOT_AGENT_HEARTBEAT_THRESHOLD_MINUTES', 10),
    'agent_upload_threshold_minutes' => (int) env('SCREENSHOT_AGENT_UPLOAD_THRESHOLD_MINUTES', 60),
];
