<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * A short plain notice. Lines are escaped and each becomes a paragraph.
 */
class NoticeMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  list<string>  $lines
     */
    public function __construct(
        public string $noticeSubject,
        public array $lines,
        public ?string $actionUrl = null,
        public ?string $actionLabel = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->noticeSubject);
    }

    public function content(): Content
    {
        $html = collect($this->lines)
            ->map(fn (string $line) => '<p style="margin:0 0 14px;font:15px/1.6 sans-serif;color:#1f1724">'.e($line).'</p>')
            ->implode('');

        if ($this->actionUrl && $this->actionLabel) {
            $html .= '<p style="margin:20px 0 0"><a href="'.e($this->actionUrl).'" style="display:inline-block;background:#9d2a8c;color:#fff;text-decoration:none;font:600 15px sans-serif;padding:12px 20px;border-radius:10px">'.e($this->actionLabel).'</a></p>';
        }

        return new Content(htmlString: $html);
    }
}
