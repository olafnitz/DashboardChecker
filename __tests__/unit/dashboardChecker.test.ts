import { DashboardChecker } from '@/lib/checks/dashboardChecker'

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(() => ({
      newContext: jest.fn(() => ({
        newPage: jest.fn(() => ({
          goto: jest.fn(),
          waitForTimeout: jest.fn(),
          waitForSelector: jest.fn(),
          $$: jest.fn(() => []),
          close: jest.fn(),
        })),
        close: jest.fn(),
      })),
      close: jest.fn(),
    })),
  },
}))

describe('DashboardChecker', () => {
  let checker: DashboardChecker

  beforeEach(() => {
    checker = new DashboardChecker()
  })

  afterEach(async () => {
    await checker.close()
  })

  describe('initialize', () => {
    it('should initialize browser successfully', async () => {
      await expect(checker.initialize()).resolves.toBeUndefined()
    })
  })

  describe('checkDashboard', () => {
    it('should return check result for valid dashboard URL', async () => {
      await checker.initialize()

      const result = await checker.checkDashboard('https://example.com/dashboard')

      expect(result).toHaveProperty('overallStatus')
      expect(result).toHaveProperty('pageResults')
      expect(Array.isArray(result.pageResults)).toBe(true)
    })

    it('should handle browser initialization failure', async () => {
      // Force browser to be null
      await checker.close()

      await expect(
        checker.checkDashboard('https://example.com/dashboard')
      ).rejects.toThrow('Browser not initialized')
    })
  })

  describe('close', () => {
    it('should close browser without error', async () => {
      await checker.initialize()
      await expect(checker.close()).resolves.toBeUndefined()
    })
  })
})