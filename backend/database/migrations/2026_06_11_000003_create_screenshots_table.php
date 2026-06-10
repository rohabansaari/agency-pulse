<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('screenshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('session_id');
            $table->string('storage_disk', 50)->default('public');
            $table->string('image_path', 500);
            $table->unsignedInteger('file_size_bytes')->default(0);
            $table->timestamp('captured_at');
            $table->timestamps();

            $table->index(['organization_id', 'user_id', 'captured_at']);
            $table->index(['organization_id', 'captured_at']);
            $table->index(['session_id', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('screenshots');
    }
};
