<?php

return [
    // Set DEMO_SEED=true to create the demo agency when the API container boots
    // (skipped if it already exists). Turn it off again afterwards.
    'seed_on_boot' => (bool) env('DEMO_SEED', false),
    'admin_email' => env('DEMO_ADMIN_EMAIL', 'demo@agencypulse.app'),
    'admin_password' => env('DEMO_ADMIN_PASSWORD', ''),
    'payroll_pin' => env('DEMO_PAYROLL_PIN', ''),
];
