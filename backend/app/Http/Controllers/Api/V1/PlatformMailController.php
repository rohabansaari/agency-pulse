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

            $message = 'Email send failed.';
            $hint = $this->mailConfiguration->renderSmtpBlockedHint();

            if ($hint && $this->isSmtpConnectionFailure($exception->getMessage())) {
                $message = 'SMTP connection timed out. Render free tier blocks ports 465/587 — set MAIL_MAILER=mailersend with MAILERSEND_API_KEY.';
            }

            return response()->json([
                'message' => $message,
                'delivery_issue' => $exception->getMessage(),
                'render_smtp_blocked_hint' => $hint,
                'mail' => $this->mailConfiguration->status(),
            ], 422);
        }

        return response()->json([
            'message' => 'Test email sent to '.$recipient.'. Check inbox and spam.',
            'mail' => $this->mailConfiguration->status(),
        ]);
    }

    private function isSmtpConnectionFailure(string $message): bool
    {
        $needles = [
            'Unable to connect',
            'Connection could not be established',
            'Operation timed out',
            'stream_socket_client',
        ];

        foreach ($needles as $needle) {
            if (str_contains($message, $needle)) {
                return true;
            }
        }

        return false;
    }
}
