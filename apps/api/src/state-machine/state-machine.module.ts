import { Module } from '@nestjs/common';
import { ORDER_TRANSITIONS, ORDER_STORE_TRANSITIONS } from './order-transitions.js';
import { RUNNER_TRANSITIONS } from './runner-transitions.js';
import { USER_TRANSITIONS } from './user-transitions.js';
import { OrderStateMachine } from './order-state-machine.js';
import { OrderStoreStateMachine } from './order-store-state-machine.js';
import { RunnerStateMachine } from './runner-state-machine.js';
import { UserStateMachine } from './user-state-machine.js';

@Module({
  providers: [
    {
      provide: OrderStateMachine,
      useFactory: () => new OrderStateMachine(ORDER_TRANSITIONS),
    },
    {
      provide: OrderStoreStateMachine,
      useFactory: () => new OrderStoreStateMachine(ORDER_STORE_TRANSITIONS),
    },
    {
      provide: RunnerStateMachine,
      useFactory: () => new RunnerStateMachine(RUNNER_TRANSITIONS),
    },
    {
      provide: UserStateMachine,
      useFactory: () => new UserStateMachine(USER_TRANSITIONS),
    },
  ],
  exports: [OrderStateMachine, OrderStoreStateMachine, RunnerStateMachine, UserStateMachine],
})
export class StateMachineModule {}