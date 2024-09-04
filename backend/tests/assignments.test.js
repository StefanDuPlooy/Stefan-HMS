// backend/tests/assignment.test.js

const request = require('supertest');
const app = require('../src/app');
const Assignment = require('../src/models/assignment');

let token;
let lecturer;

beforeEach(async () => {
  const testData = await global.createTestUser('lecturer');
  lecturer = testData.user;
  token = testData.token;
});

describe('Assignment Routes', () => {
  describe('POST /api/v1/assignments', () => {
    it('should create a new assignment', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Assignment',
          description: 'This is a test',
          dueDate: new Date(),
          totalPoints: 100
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.title).toBe('Test Assignment');
    });
  });

  describe('GET /api/v1/assignments', () => {
    it('should get all assignments', async () => {
      await Assignment.create({
        title: 'Test Assignment',
        description: 'This is a test',
        dueDate: new Date(),
        totalPoints: 100,
        createdBy: lecturer._id
      });

      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/assignments/:id', () => {
    it('should get a single assignment', async () => {
      const assignment = await Assignment.create({
        title: 'Test Assignment',
        description: 'This is a test',
        dueDate: new Date(),
        totalPoints: 100,
        createdBy: lecturer._id
      });

      const res = await request(app)
        .get(`/api/v1/assignments/${assignment._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body._id).toBe(assignment._id.toString());
    });
  });

  describe('PUT /api/v1/assignments/:id', () => {
    it('should update an assignment', async () => {
      const assignment = await Assignment.create({
        title: 'Test Assignment',
        description: 'This is a test',
        dueDate: new Date(),
        totalPoints: 100,
        createdBy: lecturer._id
      });

      const res = await request(app)
        .put(`/api/v1/assignments/${assignment._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Assignment'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.title).toBe('Updated Assignment');
    });
  });

  describe('DELETE /api/v1/assignments/:id', () => {
    it('should delete an assignment', async () => {
      const assignment = await Assignment.create({
        title: 'Test Assignment',
        description: 'This is a test',
        dueDate: new Date(),
        totalPoints: 100,
        createdBy: lecturer._id
      });

      const res = await request(app)
        .delete(`/api/v1/assignments/${assignment._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toBe(null);

      const deletedAssignment = await Assignment.findById(assignment._id);
      expect(deletedAssignment).toBeNull();
    });
  });
});