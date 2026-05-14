const User = require('../../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const user = require('../../models/user');

module.exports = {

    user: async (args) => {
        try {
            const user = await User.findById(args.userId);
            if (!user) {
                throw new Error('User not found.');
            }
            return user;
        } catch (err) {
            throw err;
        }
    },
    createUser: (args) => {
        return User.findOne({ email: args.userInput.email }).then(user => {
            if (user) {
                throw new Error('User exists already.');
            }   
            return bcrypt.hash(args.userInput.password, 12).then(hashedPassword => {
                const user = new User({
                    email: args.userInput.email,
                    password: hashedPassword
                });
                return user.save()
            })
            .then(result => {
                console.log(result);
                return { _id: result.id, email: result._doc.email, createdLifts: result._doc.createdLifts };
            })
            .catch(err => {
                console.log(err);
                throw err;
            });
        });
    },
    login: async (args) => {
        const { email, password } = args;
        const user = await User.findOne({ email: email });
        if (!user) {
            throw new Error('User does not exist!');
        }
        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) {
            throw new Error('Password is incorrect!');
        }
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            'somesupersecretkey',
            { expiresIn: '2h' }
        );
        return { userId: user.id, token: token, tokenExpiration: 2 };
    }
};
