<?php

namespace App\Services\Insights;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\RateLimitException;
use RuntimeException;

/**
 * Writes the weekly briefing with Claude. The facts are aggregates (names,
 * hours, activity %, project names, alert titles); screenshots, salaries and
 * anything typed are never sent.
 */
class ClaudeSummaryWriter implements SummaryWriter
{


    public function available(): bool
    {
        return (string) config('services.anthropic.key') !== '';
    }

    public function model(): string
    {
        return (string) config('services.anthropic.summary_model', 'claude-opus-5-5');
    }

    public function write(array $facts): array
    {
        if (! $this->available()) {
            throw new RuntimeException('AI summaries are not set up: ANTHROPIC_API_KEY is missing.');
        }

        $client = new Client(apiKey: (string) config('services.anthropic.key'));

        try {
            // Summarising a small fact sheet needs little thinking: low effort keeps it fast and cheap.
            // On a policy refusal the API retries on a suitable model ("default" fallbacks).
            $message = $client->beta->messages->create(
                maxTokens: 4000,
                messages: [[
                    'role' => 'user',
                    'content' => SummaryPrompt::userMessage($facts),
                ]],
                model: $this->model(),
                system: SummaryPrompt::SYSTEM,
                outputConfig: [
                    'effort' => 'low',
                    'format' => ['type' => 'json_schema', 'schema' => SummaryPrompt::SCHEMA],
                ],
                fallbacks: 'default',
                betas: ['server-side-fallback-2026-07-01'],
            );
        } catch (RateLimitException $e) {
            throw new RuntimeException('The AI service is busy. Try again in a minute.', 0, $e);
        } catch (APIStatusException $e) {
            throw new RuntimeException('The AI service returned an error ('.($e->type?->value ?? 'unknown').').', 0, $e);
        } catch (APIConnectionException $e) {
            throw new RuntimeException('Could not reach the AI service.', 0, $e);
        }

        if ($message->stopReason === 'refusal') {
            throw new RuntimeException('The AI service declined to write this summary.');
        }

        $text = '';
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }

        return SummaryPrompt::parse($text);
    }
}
