<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Records a signed-in person's acknowledgement of the monitoring notice and,
 * for admins, acceptance of the Terms of Service and Privacy Policy.
 */
class AgreementController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'monitoring_notice' => ['required', 'accepted'],
            'terms' => [$user->needsTermsAcceptance() ? 'accepted' : 'nullable', 'boolean'],
        ]);

        $user->forceFill([
            'monitoring_consent_at' => now(),
            'monitoring_consent_version' => config('legal.monitoring_notice_version'),
            'monitoring_consent_ip' => $request->ip(),
        ]);

        if (! empty($validated['terms'])) {
            $user->forceFill([
                'terms_accepted_at' => now(),
                'terms_version' => config('legal.terms_version'),
            ]);
        }

        $user->save();

        return response()->json(['user' => new UserResource($user)]);
    }
}
