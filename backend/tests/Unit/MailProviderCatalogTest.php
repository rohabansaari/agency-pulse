<?php

namespace Tests\Unit;

use App\Services\Mail\MailProviderCatalog;
use Tests\TestCase;

class MailProviderCatalogTest extends TestCase
{
    public function test_recommends_piisend_without_domain(): void
    {
        $catalog = app(MailProviderCatalog::class);

        $this->assertSame('piisend', $catalog->recommendedMailer());

        $piisend = collect($catalog->options())->firstWhere('id', 'piisend');
        $resend = collect($catalog->options())->firstWhere('id', 'resend');

        $this->assertTrue($piisend['recommended']);
        $this->assertFalse($piisend['domain_required']);
        $this->assertFalse($resend['recommended']);
        $this->assertTrue($resend['domain_required']);
        $this->assertFalse($piisend['credit_card_required']);
        $this->assertStringContainsString('shared sending domain', $piisend['unique_recipients']);
    }
}
