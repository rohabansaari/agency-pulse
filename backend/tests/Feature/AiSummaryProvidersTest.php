<?php

namespace Tests\Feature;

use App\Services\Insights\ClaudeSummaryWriter;
use App\Services\Insights\GeminiSummaryWriter;
use App\Services\Insights\SummaryWriter;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class AiSummaryProvidersTest extends TestCase
{
    private const SUMMARY = [
        'headline' => 'The team logged 120 h.',
        'highlights' => ['Steady week.'],
        'concerns' => [],
        'suggestions' => ['Clear approvals.'],
    ];

    private function geminiReply(string $text): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => $text]]], 'finishReason' => 'STOP']]];
    }

    public function test_gemini_is_used_when_its_key_is_set(): void
    {
        config(['services.ai_provider' => null, 'services.gemini.key' => 'g-key', 'services.anthropic.key' => 'a-key']);
        $this->assertInstanceOf(GeminiSummaryWriter::class, app(SummaryWriter::class));

        config(['services.gemini.key' => null]);
        $this->assertInstanceOf(ClaudeSummaryWriter::class, app(SummaryWriter::class));

        config(['services.gemini.key' => 'g-key', 'services.ai_provider' => 'anthropic']);
        $this->assertInstanceOf(ClaudeSummaryWriter::class, app(SummaryWriter::class));
    }

    public function test_gemini_writes_a_summary_from_json(): void
    {
        config(['services.gemini.key' => 'g-key', 'services.gemini.model' => 'gemini-4-hydrogen']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response($this->geminiReply(json_encode(self::SUMMARY)))]);

        $summary = (new GeminiSummaryWriter)->write(['people' => []]);

        $this->assertSame(self::SUMMARY, $summary);
        Http::assertSent(function (Request $request) {
            return str_contains($request->url(), '/models/gemini-4-hydrogen:generateContent')
                && $request->hasHeader('x-goog-api-key', 'g-key')
                && $request['generationConfig']['responseMimeType'] === 'application/json'
                && isset($request['generationConfig']['responseJsonSchema'])
                && str_contains($request['systemInstruction']['parts'][0]['text'], 'weekly team briefing');
        });
    }

    public function test_gemini_retries_without_the_schema_when_it_is_rejected(): void
    {
        config(['services.gemini.key' => 'g-key']);
        Http::fakeSequence('generativelanguage.googleapis.com/*')
            ->push(['error' => ['status' => 'INVALID_ARGUMENT']], 400)
            ->push($this->geminiReply("```json\n".json_encode(self::SUMMARY)."\n```"));

        $this->assertSame(self::SUMMARY, (new GeminiSummaryWriter)->write([]));

        $sent = Http::recorded()->map(fn ($pair) => $pair[0]);
        $this->assertCount(2, $sent);
        $this->assertArrayNotHasKey('responseJsonSchema', $sent[1]['generationConfig']);
    }

    public function test_gemini_quota_errors_are_explained(): void
    {
        config(['services.gemini.key' => 'g-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['status' => 'RESOURCE_EXHAUSTED']], 429)]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('free AI quota is used up');
        (new GeminiSummaryWriter)->write([]);
    }

    public function test_gemini_safety_blocks_are_reported(): void
    {
        config(['services.gemini.key' => 'g-key']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['finishReason' => 'SAFETY']]])]);

        $this->expectExceptionMessage('declined');
        (new GeminiSummaryWriter)->write([]);
    }
}
