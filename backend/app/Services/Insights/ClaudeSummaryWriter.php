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
    private const SYSTEM = <<<'PROMPT'
You write the weekly team briefing for the manager of a digital agency in Pakistan, inside AgencyPulse, a time tracking and payroll app.

You get a JSON object with the past week's facts for the people this manager oversees: hours worked per person, the share of tracked time with keyboard or mouse activity, the main project each person worked on, idle time they chose to keep, the same totals for the week before, and open alerts the app has already raised.

Write for a busy owner who reads it in under a minute:
- headline: one sentence with the single most useful takeaway, including a number.
- highlights: 2 to 4 short points on what went well or changed, each with the specific person, project or number.
- concerns: 0 to 4 short points on what needs attention. Only include real issues the facts show; an empty list is fine.
- suggestions: 1 to 3 concrete next steps the manager can take this week.

Rules:
- Use only the facts given. Never guess at causes, and never invent people, projects or numbers.
- Activity percentages measure keyboard and mouse use only. Calls, meetings, reading and design reviews show as low activity, so present a low number as something to check in about, never as proof of slacking.
- Treat people fairly and neutrally. No judgments about character or effort.
- Plain English, short sentences, no emoji, no markdown. Hours as "38.5 h", money in PKR as "Rs. 12,000".
PROMPT;

    /** @var array<string, mixed> */
    private const SCHEMA = [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['headline', 'highlights', 'concerns', 'suggestions'],
        'properties' => [
            'headline' => ['type' => 'string'],
            'highlights' => ['type' => 'array', 'items' => ['type' => 'string']],
            'concerns' => ['type' => 'array', 'items' => ['type' => 'string']],
            'suggestions' => ['type' => 'array', 'items' => ['type' => 'string']],
        ],
    ];

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
                    'content' => "Here are this week's facts:\n\n".json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
                ]],
                model: $this->model(),
                system: self::SYSTEM,
                outputConfig: [
                    'effort' => 'low',
                    'format' => ['type' => 'json_schema', 'schema' => self::SCHEMA],
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

        $data = json_decode($text, true);
        if (! is_array($data) || ! isset($data['headline'])) {
            throw new RuntimeException('The AI summary came back incomplete. Try again.');
        }

        $list = fn ($value) => array_values(array_filter(array_map('strval', is_array($value) ? $value : []), fn ($item) => trim($item) !== ''));

        return [
            'headline' => (string) $data['headline'],
            'highlights' => $list($data['highlights'] ?? []),
            'concerns' => $list($data['concerns'] ?? []),
            'suggestions' => $list($data['suggestions'] ?? []),
        ];
    }
}
