import math
from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/calculate', methods=['POST'])
def calculate():

    # Step 1: Extract data from request
    data = request.get_json()
    num1 = data.get('num1', 0)
    num2 = data.get('num2', 0)
    operation = data.get('operation', 'add')

    # Helper: every error uses the same shape, so the UI can show the message
    def error(message):
        return jsonify({
            'status': 'error',
            'input': data,
            'result': None,
            'message': message
        })

    # Step 2: Process data (business logic)
    if operation == 'add':
        result = num1 + num2
    elif operation == 'subtract':
        result = num1 - num2
    elif operation == 'multiply':
        result = num1 * num2
    elif operation == 'divide':
        if num2 == 0:
            return error('Cannot divide by zero')
        result = num1 / num2
    elif operation == 'modulo':
        if num2 == 0:
            return error('Cannot divide by zero')
        result = num1 % num2
    elif operation == 'power':
        try:
            result = num1 ** num2
        except OverflowError:
            return error('Result is too large')
        if isinstance(result, complex):
            return error('Result is not a real number')
    elif operation == 'square_root':
        if num1 < 0:
            return error('Cannot take square root of a negative number')
        result = math.sqrt(num1)
    elif operation == 'percent':
        result = num1 * num2 / 100              # num2 percent of num1
    elif operation == 'sign_toggle':
        result = -num1 if num1 != 0 else 0
    elif operation == 'tax_add':
        result = num1 * (1 + num2 / 100)        # num2 is the tax rate (%)
    elif operation == 'tax_sub':
        if num2 == -100:
            return error('Invalid tax rate')
        result = num1 / (1 + num2 / 100)
    else:
        return error('Invalid operation')

    # Keep results tidy (avoids things like 0.30000000000000004)
    if isinstance(result, float):
        result = round(result, 10)

    # Step 3: Return response
    return jsonify({
        'status': 'success',
        'input': data,
        'result': result,
        'message': 'Python processed your request!'
    })


@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'Python is running!'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)