<?php

return [
    'disk' => env('SCREENSHOT_DISK', env('FILESYSTEM_DISK', 'public')),
    'retention_days' => (int) env('SCREENSHOT_RETENTION_DAYS', 60),
    'max_upload_kb' => (int) env('SCREENSHOT_MAX_UPLOAD_KB', 5120),
    'rate_limit_per_minute' => (int) env('SCREENSHOT_RATE_LIMIT', 10),
];
