from flask import Flask, request, jsonify
import pymysql

app = Flask(__name__)
app.json.ensure_ascii = False

db = pymysql.connect(
    host="localhost",
    user="policy",
    password="policy",
    database="cheongon",
    charset="utf8"
)

@app.route('/reaction', methods=['POST'])
def reaction():
    data = request.json

    policy_id = data['policy_id']
    users_id = data['users_id']
    reaction_type = data['reaction']

    cursor = db.cursor()

    sql = """
    INSERT INTO policy_reaction (policy_id, users_id, reaction)
    VALUES (%s, %s, %s)
    ON DUPLICATE KEY UPDATE reaction = %s
    """

    cursor.execute(sql, (
        policy_id,
        users_id,
        reaction_type,
        reaction_type
    ))

    db.commit()

    return jsonify({
        "message": "반응 저장 완료"
    })



@app.route('/reaction/<policy_id>')
def get_reaction(policy_id):
    cursor = db.cursor()

    cursor.execute("""
        SELECT
            SUM(CASE WHEN reaction='like' THEN 1 ELSE 0 END),
            SUM(CASE WHEN reaction='dislike' THEN 1 ELSE 0 END)
        FROM policy_reaction
        WHERE policy_id=%s
    """, (policy_id,))

    row = cursor.fetchone()

    return jsonify({
        "likes": row[0] or 0,
        "dislikes": row[1] or 0
    })

if __name__ == '__main__':
    app.run(debug=True)


#http://127.0.0.1:5000/reaction/20250716005400111306  >>>실행 후 링크 접속해서 결과 확인