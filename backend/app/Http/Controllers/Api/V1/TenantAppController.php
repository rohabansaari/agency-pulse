<?php

namespace App\Http\Controllers\Api\V1;

abstract class TenantAppController extends TenantController
{
    public static function middleware(): array
    {
        return [
            ...parent::middleware(),
            'onboarding.complete',
        ];
    }
}
