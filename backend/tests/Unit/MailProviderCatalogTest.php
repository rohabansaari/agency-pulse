<?php

namespace Tests\Unit;

use App\Services\Mail\MailProviderCatalog;
use Tests\TestCase;

class MailProviderCatalogTest extends TestCase
{
    public function test_recommends_resend_for_render_free_tier(): void
    {
        $catalog = app(MailProviderCatalog::class);

        $this->assertSame('resend', $catalog->recommendedMailer());

        $resend = collect($catalog->options())->firstWhere('id', 'resend');
        $brevo = collect($catalog->options())->firstWhere('id', 'brevo');

        $this->assertTrue($resend['recommended']);
        $this->assertTrue($brevo['recommended']);
        $this->assertFalse($resend['credit_card_required']);
        $this->assertFalse($brevo['credit_card_required']);
        $this->assertStringContainsString('No cap', $resend['unique_recipients']);
        $this->assertStringContainsString('No cap', $brevo['unique_recipients']);
    }
}
