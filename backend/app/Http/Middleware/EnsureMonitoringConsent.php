<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Time, activity and screenshots are only recorded for people who acknowledged the notice. */
class EnsureMonitoringConsent
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->needsMonitoringConsent()) {
            return response()->json([
                'message' => 'Please read and accept the time tracking notice before starting a timer.',
                'code' => 'monitoring_consent_required',
            ], 403);
        }

        return $next($request);
    }
}
