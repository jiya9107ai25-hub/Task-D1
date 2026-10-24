import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    collection,
    getDocs,
    query,
    where,
    limit
} from 'firebase/firestore'
import bcrypt from 'bcryptjs'
import { db } from '../firebase.js'

function Login({ onLogin }) {
    const navigate = useNavigate()

    const [form, setForm] = useState({
        email: '',
        password: '',
        message: '',
        loading: false
    })

    function updateForm(changes) {
        setForm((previous) => ({ ...previous, ...changes }))
    }

    async function handleLogin(event) {
        event.preventDefault()

        if (form.loading) return

        updateForm({ message: '' })

        const cleanEmail = form.email.trim().toLowerCase()

        if (!cleanEmail || !form.password) {
            updateForm({
                message: 'Please enter your email and password.'
            })
            return
        }

        updateForm({ loading: true })

        try {
            const userQuery = query(
                collection(db, 'users'),
                where('email', '==', cleanEmail),
                limit(1)
            )

            const result = await getDocs(userQuery)

            if (result.empty) {
                updateForm({
                    message: 'Incorrect email or password. Please try again.'
                })
                return
            }

            const userDocument = result.docs[0]
            const userData = userDocument.data()

            const passwordIsCorrect = await bcrypt.compare(
                form.password,
                userData.password
            )

            if (!passwordIsCorrect) {
                updateForm({
                    message: 'Incorrect email or password. Please try again.'
                })
                return
            }

            // Share only the user ID and email with App.
            onLogin({
                id: userDocument.id,
                email: cleanEmail
            })

            navigate('/', { replace: true })
        } catch (error) {
            console.error('Login error:', error)

            updateForm({
                message: 'Unable to log in at the moment. Please try again.'
            })
        } finally {
            updateForm({ loading: false })
        }
    }

    return (
        <main className="min-h-[80vh] flex items-center justify-center px-6">
            <div className="w-full max-w-md border border-blue-400 p-10">
                <div className="flex justify-end mb-6">
                    <Link
                        to="/signup"
                        className="border border-blue-400 px-4 py-2 text-blue-600 hover:bg-blue-50"
                    >
                        Sign up
                    </Link>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="mb-6">
                        <label
                            htmlFor="email"
                            className="block font-medium mb-2"
                        >
                            Your email
                        </label>

                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={form.email}
                            onChange={(event) =>
                                updateForm({ email: event.target.value })
                            }
                            required
                            disabled={form.loading}
                            className="w-full border border-gray-300 px-4 py-3"
                        />
                    </div>

                    <div className="mb-8">
                        <label
                            htmlFor="password"
                            className="block font-medium mb-2"
                        >
                            Your password
                        </label>

                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={form.password}
                            onChange={(event) =>
                                updateForm({ password: event.target.value })
                            }
                            required
                            disabled={form.loading}
                            className="w-full border border-gray-300 px-4 py-3"
                        />
                    </div>

                    {form.message && (
                        <p
                            role="alert"
                            className="text-red-600 text-center mb-5"
                        >
                            {form.message}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={form.loading}
                        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-3"
                    >
                        {form.loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div className="text-center mt-6">
                    <Link
                        to="/signup"
                        className="text-blue-600 hover:underline"
                    >
                        Don't have an account? Sign up
                    </Link>
                </div>
            </div>
        </main>
    )
}

export default Login