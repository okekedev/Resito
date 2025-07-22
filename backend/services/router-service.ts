// ===== services/router-service.ts =====
import { NetworkScanService } from './network-scan.js';
import { RouterAIService } from './index.js';
import { RouterModel, CreateRouterData, UpdateRouterData } from '../models/router.js';

export interface RouterConnectionResult {
  success: boolean;
  message: string;
  data?: any;
  meta?: {
    aiCost?: number;
    duration?: number;
  };
}

export interface RouterDiscoveryResult {
  success: boolean;
  message: string;
  data?: {
    router?: {
      ipAddress: string;
      isAccessible: boolean;
    };
  };
}

export interface SavedRouterResult {
  success: boolean;
  data: {
    router: {
      id: string;
      ipAddress: string;
      updatedAt: Date;
    } | null;
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class RouterService {
  private aiService: RouterAIService;

  constructor() {
    this.aiService = new RouterAIService();
  }

  // Test specific router IP (debugging)
  async testSpecificIP(ip: string): Promise<RouterConnectionResult> {
    try {
      console.log(`🔧 Manually testing router at ${ip}...`);
      
      const isConnected = await NetworkScanService.testConnection(ip);
      
      return {
        success: true,
        data: {
          ip,
          isAccessible: isConnected,
          tested: true,
        },
        message: isConnected 
          ? `Router at ${ip} is accessible` 
          : `Router at ${ip} is not accessible`,
      };

    } catch (error) {
      console.error('Test specific IP error:', error);
      return {
        success: false,
        message: 'Failed to test router IP',
        data: { error: getErrorMessage(error) },
      };
    }
  }

  // Discover router on network
  async discoverRouter(): Promise<RouterDiscoveryResult> {
    try {
      console.log('🔍 Starting router discovery...');
      
      const router = await NetworkScanService.discoverRouter();

      if (!router) {
        return {
          success: false,
          message: 'No router found on network. Make sure you are connected to your home WiFi network',
        };
      }

      return {
        success: true,
        data: {
          router: {
            ipAddress: router.ipAddress,
            isAccessible: router.isAccessible,
          },
        },
        message: `Router found at ${router.ipAddress}`,
      };

    } catch (error) {
      console.error('Router discovery error:', error);
      return {
        success: false,
        message: 'Router discovery failed',
      };
    }
  }

  // Connect and save router
  async connectRouter(
    userId: string, 
    ipAddress: string, 
    username: string = 'admin', 
    password: string = 'admin'
  ): Promise<RouterConnectionResult> {
    try {
      if (!ipAddress) {
        return {
          success: false,
          message: 'Router IP address is required',
        };
      }

      // Test basic connectivity first  
      const isConnected = await NetworkScanService.testConnection(ipAddress);

      if (!isConnected) {
        return {
          success: false,
          message: 'Cannot reach router at this IP address. Please check the IP address and try again',
        };
      }

      // Save router to database
      const router = await RouterModel.upsert({
        userId,
        ipAddress,
        username,
        password,
      });

      return {
        success: true,
        data: {
          router: {
            id: router.id,
            ipAddress: router.ipAddress,
          },
        },
        message: 'Router connected and saved successfully',
      };

    } catch (error) {
      console.error('Connect router error:', error);
      return {
        success: false,
        message: 'Failed to connect router',
      };
    }
  }

  // Auto-discover and login to router (AI-powered)
  async autoConnectRouter(
    userId: string,
    ipAddress: string,
    username?: string,
    password?: string
  ): Promise<RouterConnectionResult> {
    try {
      if (!ipAddress) {
        return {
          success: false,
          message: 'Router IP address is required',
        };
      }

      console.log(`🔍 Auto-connecting to router at ${ipAddress}...`);

      // Use AI service to auto-detect router type and try credentials
      const result = await this.aiService.testConnection(ipAddress, username || 'admin', password || 'admin');

      if (result.success) {
        // If login successful, save router details (when database is available)
        try {
          await RouterModel.upsert({
            userId,
            ipAddress,
            username: username || 'admin',
            password: password || 'admin',
          });
          console.log('✅ Router saved to database:', { ipAddress, username: username || 'admin' });
        } catch (dbError) {
          console.log('⚠️ Database not available, skipping save');
        }
      }

      return {
        success: result.success,
        data: result.data,
        message: result.message,
        meta: {
          aiCost: result.aiCost,
          duration: result.duration,
        },
      };

    } catch (error) {
      console.error('Auto-connect router error:', error);
      return {
        success: false,
        message: 'Failed to auto-connect to router',
        data: { error: getErrorMessage(error) },
      };
    }
  }

  // Get saved router
  async getSavedRouter(userId: string): Promise<SavedRouterResult> {
    try {
      const router = await RouterModel.findByUserId(userId);

      return {
        success: true,
        data: {
          router: router ? {
            id: router.id,
            ipAddress: router.ipAddress,
            updatedAt: router.updatedAt,
          } : null,
        },
      };

    } catch (error) {
      console.error('Get saved router error:', error);
      return {
        success: true, // Still return success but with null router
        data: { router: null },
      };
    }
  }

  // Test router connection (AI-powered)
  async testRouterConnection(
    ipAddress: string,
    username: string = 'admin',
    password: string = 'admin'
  ): Promise<RouterConnectionResult> {
    try {
      if (!ipAddress) {
        return {
          success: false,
          message: 'Router IP address is required',
        };
      }

      console.log(`🔧 Testing AI connection to router ${ipAddress} with username: ${username}`);

      // Use AI service to test login with real credentials
      const result = await this.aiService.testConnection(ipAddress, username, password);

      return {
        success: result.success,
        data: result.data,
        message: result.message,
        meta: {
          aiCost: result.aiCost,
          duration: result.duration,
        },
      };

    } catch (error) {
      console.error('Test router error:', error);
      return {
        success: false,
        message: 'Failed to test router connection',
        data: { error: getErrorMessage(error) },
      };
    }
  }

  // Reboot router (AI-powered)
  async rebootRouter(userId: string): Promise<RouterConnectionResult> {
    try {
      // Get saved router for user
      const router = await RouterModel.findByUserId(userId);

      if (!router) {
        return {
          success: false,
          message: 'No router found. Please connect a router first',
        };
      }

      console.log(`🔄 Rebooting router ${router.ipAddress} for user ${userId}`);

      // Use AI service to reboot router
      const result = await this.aiService.rebootRouter(
        router.ipAddress,
        router.username,
        router.password
      );

      return {
        success: result.success,
        data: result.data,
        message: result.message,
        meta: {
          aiCost: result.aiCost,
          duration: result.duration,
        },
      };

    } catch (error) {
      console.error('Reboot router error:', error);
      return {
        success: false,
        message: 'Failed to reboot router',
      };
    }
  }

  // Speed test (AI-powered)
  async runSpeedTest(userId: string): Promise<RouterConnectionResult> {
    try {
      const router = await RouterModel.findByUserId(userId);

      if (!router) {
        return {
          success: false,
          message: 'No router found. Please connect a router first',
        };
      }

      console.log(`🚀 Running speed test via router ${router.ipAddress}`);

      // Use AI service to get speed information
      const result = await this.aiService.getSpeedTest(
        router.ipAddress,
        router.username,
        router.password
      );

      return {
        success: result.success,
        data: result.data,
        message: result.message,
        meta: {
          aiCost: result.aiCost,
          duration: result.duration,
        },
      };

    } catch (error) {
      console.error('Speed test error:', error);
      return {
        success: false,
        message: 'Speed test failed',
      };
    }
  }

  // Get connected devices (AI-powered)
  async getConnectedDevices(userId: string): Promise<RouterConnectionResult> {
    try {
      const router = await RouterModel.findByUserId(userId);

      if (!router) {
        return {
          success: false,
          message: 'No router found. Please connect a router first',
        };
      }

      console.log(`📱 Getting connected devices from router ${router.ipAddress}`);

      // Use AI service to get connected devices
      const result = await this.aiService.getConnectedDevices(
        router.ipAddress,
        router.username,
        router.password
      );

      return {
        success: result.success,
        data: result.data,
        message: result.message,
        meta: {
          aiCost: result.aiCost,
          duration: result.duration,
        },
      };

    } catch (error) {
      console.error('Get devices error:', error);
      return {
        success: false,
        message: 'Failed to get connected devices',
      };
    }
  }
}