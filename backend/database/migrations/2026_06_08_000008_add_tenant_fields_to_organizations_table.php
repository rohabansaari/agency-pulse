<?php

use App\Support\DatabaseMigration;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('slug')->nullable()->unique()->after('name');
            $table->string('status')->default('trial')->after('slug');
        });

        foreach (DB::table('organizations')->whereNull('slug')->get() as $organization) {
            $baseSlug = Str::slug($organization->name) ?: 'organization';
            $slug = $baseSlug;
            $suffix = 1;

            while (DB::table('organizations')->where('slug', $slug)->where('id', '!=', $organization->id)->exists()) {
                $slug = $baseSlug.'-'.$suffix;
                $suffix++;
            }

            DB::table('organizations')->where('id', $organization->id)->update([
                'slug' => $slug,
                'status' => 'trial',
            ]);
        }

        DatabaseMigration::setStringNotNull('organizations', 'slug');
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['slug', 'status']);
        });
    }
};
