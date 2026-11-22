<?php

namespace App\Services\Insights;

use RuntimeException;

/** The briefing prompt, output schema and parsing shared by every AI provider. */
final class SummaryPrompt
{
    public const SYSTEM = <<<'PROMPT'
You write the weekly team briefing for the manager of a digital agency in Pakistan, inside AgencyPulse, a time tracking and payroll app.

You get a JSON object with the past week's facts for the people this manager oversees: hours worked per person, the share of tracked time with keyboard or mouse activity, the main project each person worked on, idle time they chose to keep, the same totals for the week before, and open alerts the app has already raised.

Reply with a JSON object with exactly these keys, written for a busy owner who reads it in under a minute:
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
    public const SCHEMA = [
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

    /**
     * @return array{headline: string, highlights: list<string>, concerns: list<string>, suggestions: list<string>}
     */
    public static function parse(string $text): array
    {
        // Tolerate a ```json fence around the object.
        $text = preg_replace('/^\s*```(?:json)?\s*|\s*```\s*$/i', '', $text) ?? $text;
        $data = json_decode($text, true);
        if (! is_array($data) || ! isset($data['headline'])) {
            throw new RuntimeException('The AI summary came back incomplete. Try again.');
        }

        $list = fn ($value) => array_values(array_filter(
            array_map('strval', is_array($value) ? $value : []),
            fn (string $item) => trim($item) !== '',
        ));

        return [
            'headline' => (string) $data['headline'],
            'highlights' => $list($data['highlights'] ?? []),
            'concerns' => $list($data['concerns'] ?? []),
            'suggestions' => $list($data['suggestions'] ?? []),
        ];
    }

    /** @param array<string, mixed> $facts */
    public static function userMessage(array $facts): string
    {
        return "Here are this week's facts:\n\n".json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}
