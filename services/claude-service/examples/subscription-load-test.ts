import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

/**
 * Load test for GraphQL subscriptions
 * Tests multiple concurrent subscriptions and memory usage
 */

const AGENT_RUN_PROGRESS_SUBSCRIPTION = gql`
  subscription OnAgentRunProgress($runId: ID!) {
    agentRunProgress(runId: $runId) {
      runId
      repository
      stage
      percentage
      estimatedTimeRemaining
      currentOperation
      timestamp
      isComplete
      error
    }
  }
`;

class SubscriptionLoadTest {
  private clients: ApolloClient<any>[] = [];
  private subscriptions: any[] = [];
  private metrics = {
    connectionsCreated: 0,
    messagesReceived: 0,
    errors: 0,
    startTime: Date.now(),
    memorySnapshots: [] as any[]
  };

  constructor(
    private wsUrl: string,
    private concurrentSubscriptions: number
  ) {}

  async run() {
    console.log(`Starting load test with ${this.concurrentSubscriptions} concurrent subscriptions...`);
    
    // Take initial memory snapshot
    this.takeMemorySnapshot('initial');

    // Create clients and subscriptions
    await this.createSubscriptions();

    // Monitor for 60 seconds
    await this.monitor(60);

    // Clean up
    await this.cleanup();

    // Report results
    this.report();
  }

  private async createSubscriptions() {
    const promises = [];

    for (let i = 0; i < this.concurrentSubscriptions; i++) {
      promises.push(this.createSubscription(i));
    }

    await Promise.all(promises);
    console.log(`Created ${this.concurrentSubscriptions} subscriptions`);
    this.takeMemorySnapshot('all_connected');
  }

  private async createSubscription(index: number) {
    try {
      // Create dedicated client for this subscription
      const wsLink = new GraphQLWsLink(
        createClient({
          url: this.wsUrl,
          connectionParams: {
            clientId: `load-test-${index}`
          },
          keepAlive: 10_000,
          on: {
            connected: () => {
              this.metrics.connectionsCreated++;
            },
            error: (error) => {
              this.metrics.errors++;
              console.error(`Client ${index} error:`, error);
            }
          }
        })
      );

      const client = new ApolloClient({
        link: wsLink,
        cache: new InMemoryCache()
      });

      this.clients.push(client);

      // Subscribe to a unique run ID
      const subscription = client.subscribe({
        query: AGENT_RUN_PROGRESS_SUBSCRIPTION,
        variables: { runId: `test-run-${index}` }
      }).subscribe({
        next: (data) => {
          this.metrics.messagesReceived++;
          if (index === 0) {
            // Log first subscription for debugging
            console.log('Received update:', data);
          }
        },
        error: (err) => {
          this.metrics.errors++;
          console.error(`Subscription ${index} error:`, err);
        }
      });

      this.subscriptions.push(subscription);
    } catch (error) {
      this.metrics.errors++;
      console.error(`Failed to create subscription ${index}:`, error);
    }
  }

  private async monitor(durationSeconds: number) {
    const intervals = Math.floor(durationSeconds / 10);
    
    for (let i = 0; i < intervals; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      this.takeMemorySnapshot(`${(i + 1) * 10}s`);
      console.log(`Progress: ${(i + 1) * 10}/${durationSeconds}s, Messages: ${this.metrics.messagesReceived}`);
    }
  }

  private takeMemorySnapshot(label: string) {
    if (global.gc) {
      // Force garbage collection if available (run with --expose-gc)
      global.gc();
    }

    const usage = process.memoryUsage();
    this.metrics.memorySnapshots.push({
      label,
      timestamp: Date.now(),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    });
  }

  private async cleanup() {
    console.log('Cleaning up subscriptions...');
    
    // Unsubscribe all
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Close all clients
    for (const client of this.clients) {
      await client.stop();
    }

    this.takeMemorySnapshot('after_cleanup');
  }

  private report() {
    const duration = (Date.now() - this.metrics.startTime) / 1000;
    
    console.log('\n=== Load Test Results ===');
    console.log(`Duration: ${duration}s`);
    console.log(`Connections created: ${this.metrics.connectionsCreated}`);
    console.log(`Messages received: ${this.metrics.messagesReceived}`);
    console.log(`Errors: ${this.metrics.errors}`);
    console.log(`Messages per second: ${(this.metrics.messagesReceived / duration).toFixed(2)}`);
    
    console.log('\n=== Memory Usage ===');
    console.table(this.metrics.memorySnapshots);
    
    // Check for memory leaks
    const initial = this.metrics.memorySnapshots[0];
    const peak = this.metrics.memorySnapshots.reduce((max, snapshot) => 
      snapshot.heapUsed > max.heapUsed ? snapshot : max
    );
    const final = this.metrics.memorySnapshots[this.metrics.memorySnapshots.length - 1];
    
    console.log('\n=== Memory Analysis ===');
    console.log(`Initial heap: ${initial.heapUsed}MB`);
    console.log(`Peak heap: ${peak.heapUsed}MB (${peak.label})`);
    console.log(`Final heap: ${final.heapUsed}MB`);
    console.log(`Memory growth: ${final.heapUsed - initial.heapUsed}MB`);
    
    // Warn if significant memory growth
    const growthPercentage = ((final.heapUsed - initial.heapUsed) / initial.heapUsed) * 100;
    if (growthPercentage > 20) {
      console.warn(`⚠️  Warning: Significant memory growth detected (${growthPercentage.toFixed(1)}%)`);
    } else {
      console.log(`✅ Memory usage appears stable (${growthPercentage.toFixed(1)}% growth)`);
    }
  }
}

// Run the test
async function main() {
  const wsUrl = process.env.WS_URL || 'ws://localhost:3002/graphql';
  const concurrentSubscriptions = parseInt(process.env.CONCURRENT || '100', 10);
  
  console.log(`WebSocket URL: ${wsUrl}`);
  console.log(`Concurrent subscriptions: ${concurrentSubscriptions}`);
  
  const test = new SubscriptionLoadTest(wsUrl, concurrentSubscriptions);
  
  try {
    await test.run();
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

// Run with: node --expose-gc subscription-load-test.js
if (require.main === module) {
  main().catch(console.error);
}