<?php

namespace App\Http\Controllers\Api\V1;

/**
 * Base for organization app controllers (post-onboarding).
 * onboarding.complete middleware is applied in routes/api/v1/tenant.php.
 */
abstract class TenantAppController extends TenantController
{
}
