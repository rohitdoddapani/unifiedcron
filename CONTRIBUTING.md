# Contributing to UnifiedCron

We welcome contributions from the community! Before you start, please review this document and our [Code of Conduct](CODE_OF_CONDUCT.md).

## Developer Certificate of Origin (DCO)

By making a contribution to this project, I certify that:

1. The contribution was created in whole or in part by me and I have the right to submit it under the license indicated in the file; or
2. The contribution is based upon previous work that, to the best of my knowledge, is covered under an appropriate open source license and I have the right under that license to submit that work with modifications, whether created in whole or in part by me, under the same open source license (unless I am permitted to submit under a different license), and
3. The contribution was provided directly to me by some other person who certified (1), (2) or (3) and I have not modified it.
4. I understand and agree that this project and the contribution are public and that a record of the contribution (including all personal information I submit with it, including my sign-off) is maintained indefinitely and may be redistributed consistent with this project or the open source license(s) involved.

In short, all commits must include a `Signed-off-by` line with your real name and email address matching the Git commit author. This certifies that you have the right to submit the work under the project's license.

## Signing Your Work

To accept the DCO and sign your commits, add the `-s` or `--signoff` flag when committing:

```bash
# For a single commit
git commit -s -m "Your commit message"

# For an existing commit
git commit --amend -s

# For all commits in your branch
git rebase --signoff HEAD~5
```

The sign-off should match your Git email address. You can configure it with:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## How to Contribute

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the project's coding standards
3. **Add tests** if applicable
4. **Update documentation** as needed
5. **Sign your commits** with `-s`
6. **Submit a pull request**

## Code Style

- TypeScript/ESLint rules are enforced via the project's linting configuration
- Prettier is used for code formatting
- Follow existing patterns in the codebase
- Keep commits focused and atomic

## Testing

Before submitting a PR:

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Type checking
pnpm type-check

# Linting
pnpm lint

# Unit tests
pnpm test:unit

# Integration tests (requires PostgreSQL with _test suffix)
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/db_test pnpm test:integration
```

## Reporting Issues

Please use GitHub Issues to report bugs or request features. Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Any relevant logs or screenshots

## Security

For security vulnerabilities, please review our [SECURITY.md](SECURITY.md) file for disclosure procedures.

## Community

- Join discussions on GitHub Issues and PRs
- Follow our development in the changelog
- Respect the [Code of Conduct](CODE_OF_CONDUCT.md)

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
