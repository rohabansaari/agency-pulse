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

        $response = $this->send($body);

        // If this model or API version rejects the schema field, fall back to plain
        // JSON mode; the prompt already names the four fields.
        if ($response->status() === 400) {
            unset($body['generationConfig']['responseJsonSchema']);
            $response = $this->send($body);
        }

        if ($response->status() === 429) {
            throw new RuntimeException('The free AI quota is used up for now. Try again later.');
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

    /** @param array<string, mixed> $body */
    private function send(array $body): \Illuminate\Http\Client\Response
    {
        try {
            return Http::timeout(60)
                ->withHeaders(['x-goog-api-key' => (string) config('services.gemini.key')])
                ->post(sprintf(self::ENDPOINT, rawurlencode($this->model())), $body);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Could not reach the AI service.', 0, $e);
        }
    }
}
