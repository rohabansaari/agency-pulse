<?php



use Illuminate\Database\Migrations\Migration;

use Illuminate\Support\Facades\DB;

use Illuminate\Support\Facades\Schema;



return new class extends Migration

{

    public function up(): void

    {

        DB::table('users')->where('role', 'org_admin')->update(['role' => 'admin']);

        DB::table('organization_members')->where('role', 'org_admin')->update(['role' => 'admin']);



        if (! Schema::hasTable('roles')) {

            return;

        }



        $orgAdminRole = DB::table('roles')

            ->where('name', 'org_admin')

            ->where('guard_name', 'sanctum')

            ->first();



        if (! $orgAdminRole) {

            return;

        }



        $adminRole = DB::table('roles')

            ->where('name', 'admin')

            ->where('guard_name', 'sanctum')

            ->first();



        if ($adminRole) {

            DB::table('model_has_roles')

                ->where('role_id', $orgAdminRole->id)

                ->update(['role_id' => $adminRole->id]);



            DB::table('role_has_permissions')->where('role_id', $orgAdminRole->id)->delete();

            DB::table('roles')->where('id', $orgAdminRole->id)->delete();

        } else {

            DB::table('roles')

                ->where('id', $orgAdminRole->id)

                ->update(['name' => 'admin']);

        }

    }



    public function down(): void

    {

        DB::table('users')->where('role', 'admin')->update(['role' => 'org_admin']);

        DB::table('organization_members')->where('role', 'admin')->update(['role' => 'org_admin']);



        if (Schema::hasTable('roles')) {

            DB::table('roles')

                ->where('name', 'admin')

                ->where('guard_name', 'sanctum')

                ->update(['name' => 'org_admin']);

        }

    }

};

