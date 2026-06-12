<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\LeaveBalanceResource;
use App\Models\User;
use App\Services\Time\LeaveBalanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveBalanceController extends Controller
{
    public function __construct(
        private readonly LeaveBalanceService $leaveBalances
    ) {}

    public function mine(Request $request): JsonResponse
    {
        $balance = $this->leaveBalances->balanceForUser($request->user());

        return response()->json([
            'balance' => new LeaveBalanceResource($balance),
        ]);
    }

    public function index(): JsonResponse
    {
        $items = $this->leaveBalances->allBalances()->map(fn (array $item) => [
            'user' => [
                'id' => $item['user']->id,
                'name' => $item['user']->name,
                'email' => $item['user']->email,
                'role' => $item['user']->currentRole()?->value,
            ],
            'balance' => new LeaveBalanceResource($item['balance']),
        ]);

        return response()->json(['balances' => $items]);
    }

    public function updateLimit(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'annual_limit_days' => ['required', 'integer', 'min:0', 'max:365'],
        ]);

        $balance = $this->leaveBalances->setLimit(
            $request->user(),
            $user,
            $validated['annual_limit_days']
        );

        return response()->json([
            'message' => 'Leave limit updated.',
            'balance' => new LeaveBalanceResource($balance),
        ]);
    }

    public function reset(Request $request, User $user): JsonResponse
    {
        $balance = $this->leaveBalances->resetBalance($request->user(), $user);

        return response()->json([
            'message' => 'Leave balance reset.',
            'balance' => new LeaveBalanceResource($balance),
        ]);
    }
}
