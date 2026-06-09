<?php



use Illuminate\Database\Migrations\Migration;

use Illuminate\Database\Schema\Blueprint;

use Illuminate\Support\Facades\Schema;



return new class extends Migration

{

    public function up(): void

    {

        Schema::create('teams', function (Blueprint $table) {

            $table->id();

            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();

            $table->string('name');

            $table->foreignId('manager_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();



            $table->index(['organization_id', 'manager_id']);

        });



        Schema::create('team_members', function (Blueprint $table) {

            $table->id();

            $table->foreignId('team_id')->constrained()->cascadeOnDelete();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->timestamps();



            $table->unique(['team_id', 'user_id']);

            $table->unique('user_id');

        });

    }



    public function down(): void

    {

        Schema::dropIfExists('team_members');

        Schema::dropIfExists('teams');

    }

};

