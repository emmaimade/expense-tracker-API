import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
    try {
        let token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ error: "Access Denied" });
        }

        token = token.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: "Invalid Token" });
            }

            req.user = decoded;
            next();
        })
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired token"})
    }
}

export default authMiddleware;