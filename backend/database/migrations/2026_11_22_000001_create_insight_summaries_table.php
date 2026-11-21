<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insight_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            // "organization" for admins, "manager:{id}" for a manager's teams.
            $table->string('scope', 64);
            $table->date('period_start');
            $table->date('period_end');
            $table->json('summary');
            $table->string('model', 64);
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['organization_id', 'scope', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insight_summaries');
    }
};
