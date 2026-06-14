<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\PlatformMailTestMail;
use App\Services\Mail\MailConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class PlatformMailController extends Controller
{
    public function __construct(
        private readonly MailConfiguration $mailConfiguration,
    ) {}

    public function status(): JsonResponse
    {
        return response()->json([
            'mail' => $this->mailConfiguration->status(),
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['sometimes', 'email', 'max:255'],
        ]);

        if ($issue = $this->mailConfiguration->configurationIssue()) {
            return response()->json([
                'message' => 'Mail is not configured for delivery.',
                'mail' => $this->mailConfiguration->status(),
                'delivery_issue' => $issue,
            ], 422);
        }

        $recipient = $validated['email'] ?? $request->user()?->email;

        if (! $recipient) {
            return response()->json([
                'message' => 'No recipient email available.',
            ], 422);
        }

        try {
            Mail::to($recipient)->send(new PlatformMailTestMail($recipient));
        } catch (\Throwable $exception) {
            Log::error('Platform mail test failed.', [
                'recipient' => $recipient,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'SMTP send failed. Check Render logs and Gmail App Password.',
                'delivery_issue' => $exception->getMessage(),
                'mail' => $this->mailConfiguration->status(),
            ], 422);
        }

        return response()->json([
            'message' => 'Test email sent to '.$recipient.'. Check inbox and spam.',
            'mail' => $this->mailConfiguration->status(),
        ]);
    }
}
