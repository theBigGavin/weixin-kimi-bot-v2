/**
 * 项目分享/导入测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  ProjectShareManager,
  ShareOptions,
  ImportOptions,
  ShareCode,
  SharedProjectMetadata,
} from '../../../src/projectspace/share.js';

describe('project-share', () => {
  let testDir: string;
  let shareManager: ProjectShareManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `share-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    shareManager = new ProjectShareManager({
      storagePath: join(testDir, '.shares'),
    });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('exportProject', () => {
    it('应该导出项目为元数据', async () => {
      // Given
      const projectDir = join(testDir, 'my-project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'package.json'), JSON.stringify({
        name: 'my-project',
        version: '1.0.0',
      }));
      await writeFile(join(projectDir, 'README.md'), '# My Project');
      await mkdir(join(projectDir, 'src'), { recursive: true });
      await writeFile(join(projectDir, 'src', 'index.ts'), 'export const main = () => {};');

      // When
      const result = await shareManager.exportProject(projectDir, {
        name: 'My Project',
        description: 'A test project',
        includeCode: true,
      });

      // Then
      expect(result.success).toBe(true);
      expect(result.shareCode).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.name).toBe('My Project');
    });

    it('应该生成有效的分享码', async () => {
      // Given
      const projectDir = join(testDir, 'code-project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'test' }));

      // When
      const result = await shareManager.exportProject(projectDir, {
        name: 'Test',
        includeCode: true,
      });

      // Then
      expect(result.shareCode).toMatch(/^[A-Z0-9]{8}$/); // 8位大写字母数字
      expect(result.shareUrl).toContain(result.shareCode);
    });

    it('应该支持排除敏感文件', async () => {
      // Given
      const projectDir = join(testDir, 'secure-project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'test' }));
      await writeFile(join(projectDir, '.env'), 'SECRET_KEY=abc123');
      await writeFile(join(projectDir, 'credentials.json'), '{"token": "xxx"}');

      // When
      const result = await shareManager.exportProject(projectDir, {
        name: 'Secure Project',
        excludePatterns: ['.env', 'credentials.json', '*.key'],
      });

      // Then
      expect(result.metadata.files).not.toContain('.env');
      expect(result.metadata.files).not.toContain('credentials.json');
    });

    it('应该包含能力清单', async () => {
      // Given
      const projectDir = join(testDir, 'cap-project');
      await mkdir(projectDir, { recursive: true });
      await writeFile(join(projectDir, 'capability.json'), JSON.stringify({
        capabilities: [
          { id: 'test-cap', name: 'Test', description: 'Test capability' },
        ],
      }));

      // When
      const result = await shareManager.exportProject(projectDir, {
        name: 'Cap Project',
      });

      // Then
      expect(result.metadata.capabilities).toHaveLength(1);
      expect(result.metadata.capabilities[0].id).toBe('test-cap');
    });
  });

  describe('importProject', () => {
    it('应该通过分享码导入项目', async () => {
      // Given - 先导出一个项目
      const sourceDir = join(testDir, 'source-project');
      const targetDir = join(testDir, 'imported-project');
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, 'package.json'), JSON.stringify({ name: 'source' }));
      await writeFile(join(sourceDir, 'README.md'), '# Source');

      const exportResult = await shareManager.exportProject(sourceDir, {
        name: 'Source Project',
        includeCode: true,
      });

      // When
      const importResult = await shareManager.importProject(exportResult.shareCode, targetDir);

      // Then
      expect(importResult.success).toBe(true);
      expect(importResult.metadata.name).toBe('Source Project');
      
      // 验证文件复制
      const readme = await readFile(join(targetDir, 'README.md'), 'utf-8');
      expect(readme).toContain('Source');
    });

    it('应该支持重命名导入', async () => {
      // Given
      const sourceDir = join(testDir, 'rename-source');
      const targetDir = join(testDir, 'renamed-project');
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, 'package.json'), JSON.stringify({ name: 'original' }));

      const exportResult = await shareManager.exportProject(sourceDir, {
        name: 'Original Project',
      });

      // When
      const importResult = await shareManager.importProject(exportResult.shareCode, targetDir, {
        newName: 'Renamed Project',
      });

      // Then
      expect(importResult.success).toBe(true);
      expect(importResult.metadata.name).toBe('Renamed Project');
    });

    it('应该处理无效的分享码', async () => {
      // When
      const result = await shareManager.importProject('INVALID00', join(testDir, 'fail'));

      // Then
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该验证项目依赖', async () => {
      // Given
      const sourceDir = join(testDir, 'dep-source');
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, 'package.json'), JSON.stringify({
        name: 'dep-project',
        dependencies: { 'some-lib': '^1.0.0' },
      }));

      const exportResult = await shareManager.exportProject(sourceDir, {
        name: 'Dep Project',
      });

      // When
      const importResult = await shareManager.importProject(exportResult.shareCode, join(testDir, 'dep-import'));

      // Then
      expect(importResult.dependencies.length).toBeGreaterThan(0);
      expect(importResult.dependencies[0].name).toBe('some-lib');
    });
  });

  describe('ShareCode', () => {
    it('应该生成有效的分享码', () => {
      // When
      const code = ShareCode.generate();

      // Then
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it('应该验证分享码格式', () => {
      // Then - 有效的分享码
      expect(ShareCode.isValid('ABC12345')).toBe(true);
      expect(ShareCode.isValid('12345678')).toBe(true);

      // Then - 无效的分享码
      expect(ShareCode.isValid('abc12345')).toBe(false); // 小写
      expect(ShareCode.isValid('ABC1234')).toBe(false);  // 太短
      expect(ShareCode.isValid('ABC123456')).toBe(false); // 太长
      expect(ShareCode.isValid('ABC-1234')).toBe(false); // 包含特殊字符
    });
  });

  describe('getSharedProjectInfo', () => {
    it('应该获取分享项目的元数据', async () => {
      // Given
      const sourceDir = join(testDir, 'info-source');
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, 'package.json'), JSON.stringify({ name: 'info' }));

      const exportResult = await shareManager.exportProject(sourceDir, {
        name: 'Info Project',
        description: 'For info testing',
        author: 'Test Author',
      });

      // When
      const info = await shareManager.getSharedProjectInfo(exportResult.shareCode);

      // Then
      expect(info).toBeDefined();
      expect(info?.name).toBe('Info Project');
      expect(info?.description).toBe('For info testing');
      expect(info?.author).toBe('Test Author');
    });

    it('应该返回null对于无效分享码', async () => {
      // When
      const info = await shareManager.getSharedProjectInfo('INVALID');

      // Then
      expect(info).toBeNull();
    });
  });

  describe('listSharedProjects', () => {
    it('应该列出所有分享的项目', async () => {
      // Given - 导出多个项目
      for (let i = 0; i < 3; i++) {
        const dir = join(testDir, `list-project-${i}`);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'package.json'), JSON.stringify({ name: `p${i}` }));
        await shareManager.exportProject(dir, { name: `Project ${i}` });
      }

      // When
      const projects = await shareManager.listSharedProjects();

      // Then
      expect(projects.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('deleteSharedProject', () => {
    it('应该删除分享的项目', async () => {
      // Given
      const sourceDir = join(testDir, 'delete-source');
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, 'package.json'), JSON.stringify({ name: 'delete' }));

      const exportResult = await shareManager.exportProject(sourceDir, { name: 'Delete Project' });

      // When
      const deleteResult = await shareManager.deleteSharedProject(exportResult.shareCode);

      // Then
      expect(deleteResult).toBe(true);
      const info = await shareManager.getSharedProjectInfo(exportResult.shareCode);
      expect(info).toBeNull();
    });
  });
});
