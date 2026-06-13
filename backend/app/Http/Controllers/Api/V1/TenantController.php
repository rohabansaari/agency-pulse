<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;

/**
 * Base for organization-scoped API controllers.
 * Middleware is applied at the route level in routes/api/v1.php.
 */
abstract class TenantController extends Controller
{
}
