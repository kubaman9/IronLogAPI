const { buildSchema } = require('graphql');

module.exports = buildSchema(`
    
    type Lift {
        _id: ID!
        name: String!
        weight: Int
        sets: Int!
        reps: Int!
        type: String!
        creator: User!
        pastWeights: [Int!]
    }

    type User {
        _id: ID!
        email: String!
        password: String!
        createdLifts: [Lift!]
    }

    type AuthData {
        userId: ID!
        token: String!
        tokenExpiration: Int!
    }

    input UserInput {
        email: String!
        password: String!
    }

    input LiftInput {
        name: String!
        weight: Int
        sets: Int!
        reps: Int!
        type: String!
    }

    type RootQuery {
        lifts: [Lift!]!
        userLifts: [Lift!]!
        User: [User!]!
        login(email: String!, password: String!): AuthData!
    }

    type RootMutation {
        createLift(liftInput: LiftInput): Lift
        createUser(userInput: UserInput): User
        deleteLift(liftId: ID!): Lift
        editLift(liftId: ID!, liftInput: LiftInput): Lift
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }

`);