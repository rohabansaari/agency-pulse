<?php

namespace App\Services\Insights;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Writes the weekly briefing with Google Gemini (REST generateContent).
 * Same prompt, schema and aggregates-only facts as the Claude writer.
 * Note: on Gemini's free tier Google may use requests to improve its products.
 */
class GeminiSummaryWriter implements SummaryWriter
{
    private const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    /** Overloaded or temporarily down: worth a retry, then the fallback model. */
    private const BUSY_STATUSES = [500, 502, 503, 504];

    public function available(): bool
    {
        return (string) config('services.gemini.key') !== '';
    }

    public function model(): string
    {
        return (string) config('services.gemini.model', 'gemini-4-hydrogen');
    }

    public function write(array $facts): array
    {
        if (! $this->available()) {
            throw new RuntimeException('AI summaries are not set up: GEMINI_API_KEY is missing.');
        }

        $body = [
            'systemInstruction' => ['parts' => [['text' => SummaryPrompt::SYSTEM]]],
            'contents' => [[
                'role' => 'user',
                'parts' => [['text' => SummaryPrompt::userMessage($facts)]],
            ]],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'responseJsonSchema' => SummaryPrompt::SCHEMA,
            ],
        ];

        $response = $this->generate($body);

        // If this model or API version rejects the schema field, fall back to plain
        // JSON mode; the prompt already names the four fields.
        if ($response->status() === 400) {
            unset($body['generationConfig']['responseJsonSchema']);
            $response = $this->generate($body);
        }

        if ($response->status() === 429) {
            throw new RuntimeException('The free AI quota is used up for now. Try again later.');
        }

        if (in_array($response->status(), self::BUSY_STATUSES, true)) {
            throw new RuntimeException('The AI service is busy right now. Try again in a minute.');
        }

        if ($response->failed()) {
            $reason = (string) ($response->json('error.status') ?? $response->status());
            throw new RuntimeException("The AI service returned an error ({$reason}).");
        }

        $candidate = $response->json('candidates.0');
        if (! is_array($candidate) || ($candidate['finishReason'] ?? null) === 'SAFETY') {
            throw new RuntimeException('The AI service declined to write this summary.');
        }

        $text = collect($candidate['content']['parts'] ?? [])
            ->pluck('text')
            ->filter()
            ->implode('');

        return SummaryPrompt::parse($text);
    }

    /**
     * Calls the main model, retrying once when it is busy, then tries the
     * fallback model (GEMINI_FALLBACK_MODEL) if the main one is still busy.
     *
     * @param  array<string, mixed>  $body
     */
    private function generate(array $body): \Illuminate\Http\Client\Response
    {
        $response = $this->send($this->model(), $body);
        if (! in_array($response->status(), self::BUSY_STATUSES, true)) {
            return $response;
        }

        usleep((int) config('services.gemini.retry_delay_ms', 1500) * 1000);
        $response = $this->send($this->model(), $body);

        $fallback = (string) config('services.gemini.fallback_model', '');
        if (in_array($response->status(), self::BUSY_STATUSES, true) && $fallback !== '' && $fallback !== $this->model()) {
            $response = $this->send($fallback, $body);
        }

        return $response;
    }

    /** @param array<string, mixed> $body */
    private function send(string $model, array $body): \Illuminate\Http\Client\Response
    {
        try {
            return Http::timeout(60)
                ->withHeaders(['x-goog-api-key' => (string) config('services.gemini.key')])
                ->post(sprintf(self::ENDPOINT, rawurlencode($model)), $body);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Could not reach the AI service.', 0, $e);
        }
    }
}
