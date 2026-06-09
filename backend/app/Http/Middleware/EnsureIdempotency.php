<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyRecord;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureIdempotency
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH'], true)) {
            return $next($request);
        }

        $key = $request->header('Idempotency-Key');

        if (! $key) {
            return $next($request);
        }

        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        $existing = IdempotencyRecord::query()
            ->where('user_id', $user->id)
            ->where('idempotency_key', $key)
            ->where('expires_at', '>', now())
            ->first();

        if ($existing) {
            return response()->json(
                $existing->response_body,
                $existing->response_status
            );
        }

        $response = $next($request);

        if ($response->getStatusCode() >= 500) {
            return $response;
        }

        $body = json_decode($response->getContent(), true);

        if (! is_array($body)) {
            $body = ['message' => $response->getContent()];
        }

        IdempotencyRecord::query()->create([
            'user_id' => $user->id,
            'idempotency_key' => $key,
            'request_method' => $request->method(),
            'request_path' => $request->path(),
            'response_status' => $response->getStatusCode(),
            'response_body' => $body,
            'expires_at' => now()->addDay(),
        ]);

        return $response;
    }
}
