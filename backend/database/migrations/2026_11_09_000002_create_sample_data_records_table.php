<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks every row created by "Load sample data", so "Remove sample data"
 * deletes exactly those rows and nothing an organization created itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sample_data_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('record_type', 64);
            $table->unsignedBigInteger('record_id');
            $table->timestamp('created_at')->nullable();

            $table->index(['organization_id', 'record_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sample_data_records');
    }
};
