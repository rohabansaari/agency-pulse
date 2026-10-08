<?php

use App\Http\Middleware\AttachPayrollVaultState;
use App\Http\Middleware\EnsureIdempotency;
use App\Http\Middleware\EnsureRbac;
use App\Http\Middleware\ResolveTenant;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'rbac' => EnsureRbac::class,
            'idempotency' => EnsureIdempotency::class,
            'payroll.vault' => AttachPayrollVaultState::class,
            'super.admin' => \App\Http\Middleware\EnsureSuperAdmin::class,
            'block.super.admin' => \App\Http\Middleware\BlockSuperAdminFromTenant::class,
            'onboarding.complete' => \App\Http\Middleware\EnsureOnboardingComplete::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);

        $middleware->trustProxies(at: '*');

        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
                ? null
                : '/login'
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function (Request $request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });
    })
    ->create();

// Serverless containers (Vercel) only guarantee /tmp is writable.
if ($storagePath = getenv('LARAVEL_STORAGE_PATH')) {
    $app->useStoragePath($storagePath);
}

return $app;
