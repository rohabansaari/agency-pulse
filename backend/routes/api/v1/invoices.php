<?php

use App\Http\Controllers\Api\V1\InvoiceController;
use Illuminate\Support\Facades\Route;

Route::middleware('rbac:admin')->group(function () {
    Route::get('/', [InvoiceController::class, 'index']);
    Route::post('/', [InvoiceController::class, 'store']);
    Route::get('/unbilled', [InvoiceController::class, 'unbilled']);
    Route::get('/settings', [InvoiceController::class, 'settings']);
    Route::put('/settings', [InvoiceController::class, 'updateSettings']);
    Route::get('/{invoice}', [InvoiceController::class, 'show'])->whereNumber('invoice');
    Route::put('/{invoice}', [InvoiceController::class, 'update'])->whereNumber('invoice');
    Route::delete('/{invoice}', [InvoiceController::class, 'destroy'])->whereNumber('invoice');
    Route::post('/{invoice}/send', [InvoiceController::class, 'send'])->whereNumber('invoice');
    Route::post('/{invoice}/payments', [InvoiceController::class, 'pay'])->whereNumber('invoice');
    Route::post('/{invoice}/void', [InvoiceController::class, 'void'])->whereNumber('invoice');
});
