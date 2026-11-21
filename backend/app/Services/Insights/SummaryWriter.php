<?php

namespace App\Services\Insights;

/**
 * Turns a week of team facts into a short briefing for a manager.
 */
interface SummaryWriter
{
    public function available(): bool;

    /** The model id recorded with each summary. */
    public function model(): string;

    /**
     * @param  array<string, mixed>  $facts
     * @return array{headline: string, highlights: list<string>, concerns: list<string>, suggestions: list<string>}
     */
    public function write(array $facts): array;
}
