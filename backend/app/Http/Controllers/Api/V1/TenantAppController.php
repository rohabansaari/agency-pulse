<?php

namespace App\Http\Controllers\Api\V1;

abstract class TenantAppController extends TenantController
{
    public function __construct()
    {
        parent::__construct();
        $this->middleware('onboarding.complete');
    }
}
