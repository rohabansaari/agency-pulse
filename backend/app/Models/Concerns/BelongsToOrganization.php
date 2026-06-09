<?php

namespace App\Models\Concerns;

use App\Models\Organization;
use App\Models\User;
use App\Services\Tenant\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToOrganization
{
    public static function bootBelongsToOrganization(): void
    {
        static::addGlobalScope('organization', function (Builder $builder): void {
            if (! TenantContext::has()) {
                return;
            }

            $builder->where(
                $builder->qualifyColumn('organization_id'),
                TenantContext::id()
            );
        });

        static::creating(function (Model $model): void {
            if ($model->getAttribute('organization_id')) {
                return;
            }

            if (TenantContext::has()) {
                $model->setAttribute('organization_id', TenantContext::id());

                return;
            }

            $organizationId = auth()->user()?->organization_id;

            if ($organizationId === null && $model->getAttribute('user_id')) {
                $organizationId = User::query()
                    ->whereKey($model->getAttribute('user_id'))
                    ->value('organization_id');
            }

            if ($organizationId !== null) {
                $model->setAttribute('organization_id', $organizationId);
            }
        });
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
