// backend/tests/videos.test.js

const request = require('supertest');
const app = require('../src/app');
const Video = require('../src/models/video');
const path = require('path');

let token;
let user;

beforeEach(async () => {
  const testData = await global.createTestUser();
  user = testData.user;
  token = testData.token;
});

describe('Video Routes', () => {
  describe('POST /api/v1/videos', () => {
    it('should upload a video', async () => {
      const res = await request(app)
        .post('/api/v1/videos')
        .set('Authorization', `Bearer ${token}`)
        .attach('video', path.resolve(__dirname, './testfiles/test-video.mp4'))
        .field('title', 'Test Video')
        .field('description', 'This is a test video');

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.title).toBe('Test Video');
    });
  });

  describe('GET /api/v1/videos', () => {
    it('should get all videos', async () => {
      await Video.create({
        title: 'Test Video',
        description: 'This is a test',
        filePath: '/path/to/video.mp4',
        uploadedBy: user._id
      });

      const res = await request(app)
        .get('/api/v1/videos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/videos/:id', () => {
    it('should get a single video', async () => {
      const video = await Video.create({
        title: 'Test Video',
        description: 'This is a test',
        filePath: '/path/to/video.mp4',
        uploadedBy: user._id
      });

      const res = await request(app)
        .get(`/api/v1/videos/${video._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body._id).toBe(video._id.toString());
    });
  });

  describe('PUT /api/v1/videos/:id', () => {
    it('should update a video', async () => {
      const video = await Video.create({
        title: 'Test Video',
        description: 'This is a test',
        filePath: '/path/to/video.mp4',
        uploadedBy: user._id
      });

      const res = await request(app)
        .put(`/api/v1/videos/${video._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Video'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.title).toBe('Updated Video');
    });
  });

  describe('DELETE /api/v1/videos/:id', () => {
    it('should delete a video', async () => {
      const video = await Video.create({
        title: 'Test Video',
        description: 'This is a test',
        filePath: '/path/to/video.mp4',
        uploadedBy: user._id
      });

      const res = await request(app)
        .delete(`/api/v1/videos/${video._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBe(null);

      const deletedVideo = await Video.findById(video._id);
      expect(deletedVideo).toBeNull();
    });
  });
});