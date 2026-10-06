import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GUIDE_PDF, displayAddress, guideTopics, totalMinutes } from './topics';

const PUBLIC = fileURLToPath(new URL('../../../public/uitleg', import.meta.url));
const topics = guideTopics('planbord.voorbeeld.nl');

describe('uitleg voor collega’s', () => {
  it('heeft voor elke video een mp4 en een poster in public/uitleg', () => {
    for (const video of topics.flatMap((topic) => topic.videos)) {
      expect(fs.existsSync(path.join(PUBLIC, `${video.file}.mp4`)), `${video.file}.mp4`).toBe(true);
      expect(fs.existsSync(path.join(PUBLIC, `${video.file}.jpg`)), `${video.file}.jpg`).toBe(true);
    }
  });

  it('heeft de PDF in public/uitleg', () => {
    expect(fs.existsSync(path.join(PUBLIC, GUIDE_PDF))).toBe(true);
  });

  it('heeft geen video in public/uitleg die nergens wordt gebruikt', () => {
    const used = new Set(topics.flatMap((topic) => topic.videos.map((video) => `${video.file}.mp4`)));
    const present = fs.readdirSync(PUBLIC).filter((file) => file.endsWith('.mp4'));
    expect(present.filter((file) => !used.has(file))).toEqual([]);
  });

  it('heeft unieke onderwerpen met stappen', () => {
    const ids = topics.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of topics) {
      expect(topic.videos.length).toBeGreaterThan(0);
      expect(topic.steps.flatMap((group) => group.steps).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('zet het adres van de app in de stappen voor het beginscherm', () => {
    const steps = topics.find((topic) => topic.id === 'beginscherm')?.steps.flatMap((group) => group.steps) ?? [];
    expect(steps.filter((step) => step.includes('planbord.voorbeeld.nl'))).toHaveLength(2);
  });

  it('legt de agenda uit voor iPhone én Android', () => {
    const agenda = topics.find((topic) => topic.id === 'agenda');
    const iphone = agenda?.steps.find((group) => group.device === 'iPhone')?.steps.join(' ') ?? '';
    const android = agenda?.steps.find((group) => group.device === 'Android')?.steps.join(' ') ?? '';
    expect(iphone).toContain('Toevoegen aan agenda');
    // Op Android werkt die knop niet: daar kopieer je de link en gaat het via de website van Google.
    expect(android).not.toContain('Toevoegen aan agenda');
    expect(android).toContain('Kopieer link');
    expect(android).toContain('calendar.google.com');
    expect(android).toContain('Synchroniseren');
  });

  it('noemt geen e-mailadressen en geen redenen van afwezigheid', () => {
    const text = JSON.stringify(topics);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(text.toLowerCase()).not.toMatch(/ziek|zwanger|dokter|tandarts/);
  });

  it('toont het adres zonder https:// en zonder schuine streep', () => {
    expect(displayAddress('https://planbord.voorbeeld.nl/')).toBe('planbord.voorbeeld.nl');
    expect(displayAddress('http://localhost:3000')).toBe('localhost:3000');
  });

  it('telt de speelduur in hele minuten', () => {
    expect(totalMinutes(topics)).toBe(4);
    expect(totalMinutes([])).toBe(1);
  });
});
