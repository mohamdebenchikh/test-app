const catchAsync = require('../../src/utils/catchAsync');

describe('catchAsync', () => {
  it('should call the async function with req, res, and next', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    
    const asyncFn = jest.fn().mockResolvedValue('result');
    const wrappedFn = catchAsync(asyncFn);
    
    await wrappedFn(req, res, next);
    
    expect(asyncFn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with the error when the async function rejects', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    const error = new Error('Test error');
    
    const asyncFn = jest.fn().mockRejectedValue(error);
    const wrappedFn = catchAsync(asyncFn);
    
    await wrappedFn(req, res, next);
    
    expect(asyncFn).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});