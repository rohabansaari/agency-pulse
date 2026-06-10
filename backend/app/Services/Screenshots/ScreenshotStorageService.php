<?php

namespace App\Services\Screenshots;

use App\Models\Screenshot;
use App\Models\Team;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ScreenshotStorageService
{
    public function store(int $organizationId, int $userId, string $binary, string $extension = 'jpg'): array
    {
        $disk = (string) config('screenshots.disk', 'public');
        $now = now();
        $filename = Str::uuid()->toString().'.'.$extension;
        $path = sprintf(
            'org/%d/screenshots/%d/%s/%s/%s',
            $organizationId,
            $userId,
            $now->format('Y'),
            $now->format('m'),
            $filename
        );

        $stored = Storage::disk($disk)->put($path, $binary);

        if (! $stored) {
            throw new RuntimeException('Failed to store screenshot.');
        }

        return [
            'disk' => $disk,
            'path' => $path,
            'size' => strlen($binary),
        ];
    }

    public function delete(Screenshot $screenshot): void
    {
        if ($screenshot->image_path === '') {
            return;
        }

        Storage::disk($screenshot->storage_disk)->delete($screenshot->image_path);
    }

    public function url(Screenshot $screenshot): ?string
    {
        if ($screenshot->image_path === '') {
            return null;
        }

        $disk = Storage::disk($screenshot->storage_disk);

        if (method_exists($disk, 'temporaryUrl')) {
            try {
                return $disk->temporaryUrl($screenshot->image_path, now()->addMinutes(30));
            } catch (\Throwable) {
                // Fall through to public URL when temporary URLs are unsupported.
            }
        }

        return $disk->url($screenshot->image_path);
    }

    /**
     * @return array{0: string, 1: string} Binary payload and file extension.
     */
    public function decodePayload(string $image): array
    {
        $payload = trim($image);

        if (preg_match('/^data:image\/(\w+);base64,(.+)$/s', $payload, $matches) === 1) {
            $extension = strtolower($matches[1]) === 'jpeg' ? 'jpg' : strtolower($matches[1]);
            $binary = base64_decode($matches[2], true);

            if ($binary === false) {
                throw new RuntimeException('Invalid base64 image payload.');
            }

            return [$binary, $extension];
        }

        $binary = base64_decode($payload, true);

        if ($binary === false) {
            throw new RuntimeException('Invalid base64 image payload.');
        }

        return [$binary, 'jpg'];
    }

    public function compressIfNeeded(string $binary, string $extension): array
    {
        $maxBytes = (int) config('screenshots.max_upload_kb', 5120) * 1024;

        if (strlen($binary) <= $maxBytes || ! function_exists('imagecreatefromstring')) {
            return [$binary, $extension];
        }

        $image = @imagecreatefromstring($binary);

        if ($image === false) {
            return [$binary, $extension];
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $scale = min(1.0, sqrt($maxBytes / max(strlen($binary), 1)));
        $targetWidth = max(1, (int) round($width * $scale));
        $targetHeight = max(1, (int) round($height * $scale));

        $resized = imagecreatetruecolor($targetWidth, $targetHeight);
        imagecopyresampled($resized, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        ob_start();
        imagejpeg($resized, null, 75);
        $compressed = (string) ob_get_clean();

        imagedestroy($image);
        imagedestroy($resized);

        return [$compressed, 'jpg'];
    }
}
