<?php



use Illuminate\Database\Migrations\Migration;

use Illuminate\Database\Schema\Blueprint;

use Illuminate\Support\Facades\DB;

use Illuminate\Support\Facades\Schema;



return new class extends Migration

{

    public function up(): void

    {

        Schema::create('project_assignments', function (Blueprint $table) {

            $table->id();

            $table->foreignId('project_id')->constrained()->cascadeOnDelete();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('role_in_project')->default('worker');

            $table->timestamps();



            $table->unique(['project_id', 'user_id']);

            $table->index(['user_id', 'project_id']);

        });



        if (Schema::hasTable('project_user')) {

            foreach (DB::table('project_user')->get() as $row) {

                DB::table('project_assignments')->insert([

                    'project_id' => $row->project_id,

                    'user_id' => $row->user_id,

                    'role_in_project' => 'worker',

                    'created_at' => $row->created_at,

                    'updated_at' => $row->updated_at,

                ]);

            }



            Schema::drop('project_user');

        }

    }



    public function down(): void

    {

        Schema::create('project_user', function (Blueprint $table) {

            $table->id();

            $table->foreignId('project_id')->constrained()->cascadeOnDelete();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->timestamps();

            $table->unique(['project_id', 'user_id']);

        });



        foreach (DB::table('project_assignments')->get() as $row) {

            DB::table('project_user')->insert([

                'project_id' => $row->project_id,

                'user_id' => $row->user_id,

                'created_at' => $row->created_at,

                'updated_at' => $row->updated_at,

            ]);

        }



        Schema::dropIfExists('project_assignments');

    }

};

